require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Amrah AI Backend Running' });
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Quota check
app.get('/api/user/quota', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { data, error } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    res.json({ quota: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stripe checkout
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, userId } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: userId
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
