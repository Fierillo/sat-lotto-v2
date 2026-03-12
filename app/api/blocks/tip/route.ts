import { NextResponse } from 'next/server';
import { cachedBlock, syncData } from '@/lib/cache';

export async function GET() {
    await syncData();
    return NextResponse.json(cachedBlock);
}