// One-off helper for creating your first admin login, since there's no signup flow (the admins
// table is meant to be populated by you directly in the Supabase table editor, per build-spec
// section 1). Usage:
//
//   node scripts/hash-password.js "your-password-here"
//
// Then insert a row into `admins` with your email and the printed hash as password_hash.
const bcrypt = require("bcryptjs");

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.js <password>");
  process.exit(1);
}

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
});
