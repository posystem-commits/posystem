// Inserts (or updates) a row in `admins` directly via the service-role key — a faster companion
// to scripts/hash-password.js for when you'd rather not copy/paste SQL into the Supabase editor.
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local. Usage:
//
//   node -r dotenv/config scripts/create-admin.js "you@example.com" "your-password" dotenv_config_path=.env.local
//
// or simpler, since Node 20+ supports --env-file natively:
//
//   node --env-file=.env.local scripts/create-admin.js "you@example.com" "your-password"
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin.js "email" "password"');
  process.exit(1);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (pass --env-file=.env.local)");
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase
    .from("admins")
    .upsert({ email: email.trim().toLowerCase(), password_hash }, { onConflict: "email" });

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  console.log(`Admin login ready for ${email}`);
}

main();
