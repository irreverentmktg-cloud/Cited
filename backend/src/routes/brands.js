const express  = require('express');
const router   = express.Router();
const { supabase } = require('../lib/supabase');
const { scrapeBrand } = require('../services/scraper');
const { generatePrompts } = require('../services/promptGenerator');

// GET /api/brands/:id/overview  — dashboard overview data
router.get('/:id/overview', async (req, res) => {
  if (!supabase) return res.json({ message: 'Supabase not configured' });
  const { id } = req.params;

  const [{ data: brand }, { data: score }, { data: dailyPrompt }, { data: alerts }] = await Promise.all([
    supabase.from('brands').select('*').eq('id', id).single(),
    supabase.from('v_brand_latest_score').select('*').eq('brand_id', id).single(),
    supabase.from('daily_priority_prompts').select('*, prompts(prompt_text)').eq('brand_id', id).order('priority_date', { ascending: false }).limit(1).single(),
    supabase.from('alerts').select('*').eq('brand_id', id).eq('is_read', false).order('created_at', { ascending: false }).limit(10)
  ]);

  res.json({ brand, score, daily_prompt: dailyPrompt, alerts });
});

// GET /api/brands/:id/daily-prompt
router.get('/:id/daily-prompt', async (req, res) => {
  if (!supabase) return res.json({ message: 'Supabase not configured' });
  const { id } = req.params;
  const { data } = await supabase
    .from('daily_priority_prompts')
    .select('*, prompts(prompt_text, category, opportunity_score)')
    .eq('brand_id', id)
    .order('priority_date', { ascending: false })
    .limit(1)
    .single();
  res.json(data);
});

// PATCH /api/brands/:id/calibration — save onboarding calibration
router.patch('/:id/calibration', async (req, res) => {
  if (!supabase) return res.json({ message: 'Supabase not configured' });
  const { id } = req.params;
  const fields = req.body;

  const { data, error } = await supabase
    .from('brands')
    .update({ ...fields, calibration_confirmed: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // After calibration confirmed, generate prompts
  if (data) {
    generatePrompts(data, 50).then(async (prompts) => {
      const rows = prompts.map(p => ({
        brand_id:         id,
        prompt_text:      p.prompt_text,
        category:         p.category,
        is_branded:       p.is_branded || false,
        opportunity_score: p.opportunity_score,
        source:           'ai_generated',
        status:           'active'
      }));
      await supabase.from('prompts').upsert(rows, { onConflict: 'brand_id,prompt_text' });
    });
  }

  res.json(data);
});

module.exports = router;
