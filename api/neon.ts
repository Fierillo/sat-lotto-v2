export async function queryNeon(query: string, params: any[]) {
    const url = new URL(process.env.NEON_URL!);
    url.pathname = '/';
    const host = url.hostname;

    console.log(`[Neon] Execute: ${query.replace(/\s+/g, ' ').substring(0, 50)}...`);
    const res = await fetch(`https://${host}/sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
            'Neon-Connection-String': process.env.NEON_URL!
        },
        body: JSON.stringify({ query, params })
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[Neon] Error: ${errText}`);
        throw new Error(`Neon HTTP error: ${errText}`);
    }
    const data: any = await res.json();

    if (!data || !data.rows) return [];
    return data.rows;
}
