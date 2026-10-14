"use server";

import { revalidatePath } from "next/cache";
import { clearDemoData } from "@/data/holdings.repo";

export async function clearDemoDataAction() {
  await clearDemoData();
  revalidatePath("/", "layout");
}
