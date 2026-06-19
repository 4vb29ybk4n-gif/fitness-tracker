import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xpjdwgdcqxoojkkyyuoo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwamR3Z2RjcXhvb2pra3l5dW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjEzNDIsImV4cCI6MjA5NzQzNzM0Mn0.7atSwK_T4pJA1BsipLKOfSx3s2U_jMpCBsI_veA_Njo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 사용자 식별 ──────────────────────────────────────
// 기기에 고유 ID를 저장해서 "이 사용자"를 식별합니다.
// 같은 사용자가 다른 기기에서 같은 기록을 보려면 USER_ID를 똑같이 맞추면 됩니다.
export function getUserId() {
  let uid = localStorage.getItem("ft_user_id");
  if (!uid) {
    uid = "user_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("ft_user_id", uid);
  }
  return uid;
}

export function setUserId(id) {
  localStorage.setItem("ft_user_id", id);
}

// ── 저장/불러오기 헬퍼 ───────────────────────────────
export async function loadData(userId, key, fallback) {
  try {
    const { data, error } = await supabase
      .from("fitness_data")
      .select("data_value")
      .eq("user_id", userId)
      .eq("data_key", key)
      .maybeSingle();
    if (error) { console.error("load error", error); return fallback; }
    return data ? data.data_value : fallback;
  } catch (e) {
    console.error("load exception", e);
    return fallback;
  }
}

export async function saveData(userId, key, value) {
  try {
    const { error } = await supabase
      .from("fitness_data")
      .upsert(
        { user_id: userId, data_key: key, data_value: value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,data_key" }
      );
    if (error) { console.error("save error", error); return false; }
    return true;
  } catch (e) {
    console.error("save exception", e);
    return false;
  }
}
