import { NextResponse } from 'next/server';
import { cachedBlock, syncData } from '@/lib/cache';

export async function GET() {
    await syncData();
    const netBalance = Math.floor(cachedBlock.poolBalance * 0.958);
    return NextResponse.json({ ...cachedBlock, poolBalance: netBalance });
}