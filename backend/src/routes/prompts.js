const express  = require('express');
const router   = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/prompts/:brandId  — prompt feed with citation summary
router.get('/:brandId', async (req, res) => {
  if (!supabase) return res.json({ message: 'Supabase not configured' });
  const { filter } = req.query; // 'all' | 'not_cited' | 'competitor_owned'
  const { brandId } = req.params;

  let query = supabase
    .from('v_prompt_citation_summary')
    .select('*')
    .eq('brand_id', brandId)
    .order('opportunity_score', { ascending: false });

  if (filter === 'not_cited') query = query.eq('ever_cited', false);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
