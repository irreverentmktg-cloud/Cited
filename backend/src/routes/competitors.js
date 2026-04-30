const express  = require('express');
const router   = express.Router();
const { supabase } = require('../lib/supabase');

router.get('/:brandId', async (req, res) => {
  if (!supabase) return res.json([]);
  const [{ data: competitors }, { data: gaps }] = await Promise.all([
    supabase.from('competitors').select('*').eq('brand_id', req.params.brandId).order('prompts_owned', { ascending: false }),
    supabase.from('v_competitor_gaps').select('*').eq('brand_id', req.params.brandId).limit(20)
  ]);
  res.json({ competitors: competitors || [], gaps: gaps || [] });
});

module.exports = router;
