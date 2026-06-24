const fs = require('fs');

const supabaseCode = fs.readFileSync('d:\\quanly_admin_vanilla\\js\\supabase.js', 'utf8');
try {
  new Function(supabaseCode);
  console.log("Syntax is valid");
} catch (e) {
  console.error("Syntax error:", e);
}
