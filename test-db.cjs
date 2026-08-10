const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const lines = env.split('\n');
  const url = lines.find(l => l.startsWith('VITE_SUPABASE_URL')).split('=')[1].trim();
  const key = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY')).split('=')[1].trim();
  const supabase = createClient(url, key);

  const { data: students } = await supabase.from('students').select('*').eq('name', 'AMNA C').limit(1);
  const s = students[0];
  
  const { data: att } = await supabase.from('attendance').select('*').eq('student_id', s.id);
  console.log(`Total attendance records for ${s.name}:`, att.length);
  console.log(att.map(a => a.date).join(', '));
}
run();
