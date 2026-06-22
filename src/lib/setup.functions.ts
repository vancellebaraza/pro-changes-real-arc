import { createServerFn } from "@tanstack/react-start";

const FIXED_ACCOUNTS = [
  {
    email: "admin.operations@fusionpro.realarc.co.ke",
    password: "RArc$Admin#2026!OpsX91",
    full_name: "FusionPro Admin",
    role: "admin" as const,
  },
  {
    email: "eng.fieldservices@fusionpro.realarc.co.ke",
    password: "Fus!0nPr0_Eng#8472",
    full_name: "FusionPro Field Engineer",
    role: "engineer" as const,
  },
  {
    email: "accountant2026@fusionpro.realarc.co.ke",
    password: "accountant 2026",
    full_name: "FusionPro Accountant",
    role: "accountant" as const,
  },
];

export const ensureFixedAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;

  for (const acc of FIXED_ACCOUNTS) {
    const found = list.users.find((u) => u.email?.toLowerCase() === acc.email.toLowerCase());
    
    if (!found) {
      // Create the user
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name },
      });
      
      if (error && !String(error.message).toLowerCase().includes("already")) throw error;
      
      // Assign role if user was created successfully
      if (newUser?.user?.id) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role: acc.role })
          .throwOnError();
      }
    } else {
      // User exists, ensure they have the correct role
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", found.id)
        .eq("role", acc.role);

      if (!existingRoles || existingRoles.length === 0) {
        // Delete any existing roles and insert the correct one
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", found.id);

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: found.id, role: acc.role })
          .throwOnError();
      }
    }
  }

  return { ok: true };
});
