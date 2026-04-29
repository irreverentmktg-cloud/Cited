const express  = require('express');
const router   = express.Router();
const { supabase } = require('../lib/supabase');

router.get('/:brandId', async (req, res) => {
  if (!supabase) return res.json([]);
  const { data } = await supabase
    .from('alerts')
    .select('*')
    .eq('brand_id', req.params.brandId)
    .order('created_at', { ascending: false })
    .limit(20);
  res.json(data || []);
});

router.patch('/:id/read', async (req, res) => {
  if (!supabase) return res.json({ ok: true });
  await supabase.from('alerts').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
