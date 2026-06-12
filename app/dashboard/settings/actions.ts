"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations";

export type SettingsFormState = {
  error: string | null;
  success: string | null;
};

export async function updateProfileAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      success: null,
    };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/dashboard", "layout");
  return { error: null, success: "Profile updated." };
}

/**
 * Delete the account: remove the user (accounts/sessions cascade via the
 * Prisma schema), then sign out.
 */
export async function deleteAccountAction() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  await prisma.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
}
