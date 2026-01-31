import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Get users error:", error);
            return NextResponse.json({ users: [], error: error.message });
        }

        return NextResponse.json({ users: data || [] });
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ users: [], error: "Failed to fetch users" });
    }
}
