/**
 * GET /api/scores/:brandId
 * Returns the latest score + 30-day history for a brand.
 */
const express  = require('express');
const router   = express.Router();
const { supabase } = require('../lib/supabase');

router.get('/:brandId', async (req, res) => {
  if (!supabase) return res.json({ message: 'Supabase not configured' });
  const { brandId } = req.params;

  const { data: latest } = await supabase
    .from('v_brand_latest_score')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  const { data: history } = await supabase
    .from('brand_scores')
    .select('score_date, overall_score, score_delta')
    .eq('brand_id', brandId)
    .order('score_date', { ascending: false })
    .limit(30);

  res.json({ latest, history });
});

module.exports = router;
