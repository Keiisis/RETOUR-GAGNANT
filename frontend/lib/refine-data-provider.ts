import { supabase } from "@/lib/supabase";
import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";

export const dataProvider = supabaseDataProvider(supabase);
