import 'dotenv/config';
import { dbGetAll } from '../../src/lib/db';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.API_URL || 'http://localhost:3000';
const LOG_DIR = path.join(__dirname, '../../test-results');
const LOG_FILE = path.join(LOG_DIR, `test-log-${Date.now()}.txt`);

interface Bet {
    selected_number: number;
    is_paid: boolean;
    payment_hash: string;
    pubkey: string;
}

const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
};

function ask(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(`${question}: `, (answer: string) => {
            rl.close();
            resolve(answer.toLowerCase().trim());
        });
    });
}

async function getBetsForBlock(targetBlock: number): Promise<Bet[]> {
    log(`[DEBUG] Querying ALL bets for block=${targetBlock}`);
    try {
        const bets = await dbGetAll<Bet>('lotto_bets', { target_block: targetBlock });
        log(`[DEBUG] Found ${bets.length} total bets for block ${targetBlock}`);
        for (const bet of bets) {
            log(`[DEBUG]   - pubkey: ${bet.pubkey.slice(0, 10)}..., number: ${bet.selected_number}, paid: ${bet.is_paid}, hash: ${bet.payment_hash.slice(0, 15)}...`);
        }
        return bets;
    } catch (e: any) {
        log(`[ERROR] DB query failed: ${e.message}`);
        return [];
    }
}

async function main() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    log(`============================================================`);
    log(`INTERACTIVE PAYMENT FLOW TEST`);
    log(`============================================================`);
    log(`Log file: ${LOG_FILE}`);

    log(`Fetching state from ${API_URL}/api/state...`);
    let state;
    try {
        state = await fetch(`${API_URL}/api/state`).then(r => r.json());
        log(`State fetched - block: ${state.block?.height}, target: ${state.block?.target}`);
    } catch (e: any) {
        log(`ERROR: Failed to fetch state: ${e.message}`);
        return;
    }
    
    const targetBlock = state.block.target;
    log(`Target block: ${targetBlock}`);

    log(``);
    log(`IMPORTANT: This test will show ALL bets for block ${targetBlock}`);
    log(`You must manually identify YOUR bet(s) after each step`);
    log(``);

    const results: { step: string; ok: boolean; reason?: string }[] = [];

    // STEP 1
    log(`============================================================`);
    log(`STEP 1: FIRST BET (Number 9)`);
    log(`============================================================`);
    log(`Instructions:`);
    log(`1. Login with nos2x extension`);
    log(`2. Select number 9 on the clock`);
    log(`3. Click APOSTAR`);
    log(`4. EXPECTED: InvoiceModal appears`);
    log(`5. Pay invoice in your wallet`);
    log(`6. Click "Verificar pago" until confirmed`);

    let answer = await ask(`Did InvoiceModal appear? (y/n)`);
    log(`User answered InvoiceModal: ${answer}`);
    
    if (answer === 'y') {
        answer = await ask(`Did you complete the payment? (y/n)`);
        log(`User answered payment completed: ${answer}`);
        
        if (answer === 'y') {
            log(`Fetching all bets for block ${targetBlock}...`);
            const allBets = await getBetsForBlock(targetBlock);
            const userPubkey = await ask(`Enter your pubkey (from the app):`);
            log(`User entered pubkey: ${userPubkey}`);
            
            const userBets = allBets.filter(b => b.pubkey.toLowerCase() === userPubkey.toLowerCase());
            log(`Found ${userBets.length} bet(s) for this pubkey`);
            
            const paidBet9 = userBets.find(b => b.selected_number === 9 && b.is_paid);
            if (paidBet9) {
                results.push({ step: 'STEP 1', ok: true });
                log(`RESULT: OK - Bet for number 9 is PAID`);
            } else {
                log(`WARNING: Could not verify payment in DB`);
                log(`UserBets: ${JSON.stringify(userBets)}`);
                answer = await ask(`Is your bet for number 9 shown as PAID in the app? (y/n)`);
                if (answer === 'y') {
                    results.push({ step: 'STEP 1', ok: true });
                    log(`RESULT: OK - User confirmed bet is paid`);
                } else {
                    results.push({ step: 'STEP 1', ok: false, reason: 'Payment not confirmed' });
                    log(`RESULT: FAIL - Payment not confirmed`);
                }
            }
        } else {
            results.push({ step: 'STEP 1', ok: false, reason: 'User did not complete payment' });
            log(`RESULT: FAIL - User did not complete payment`);
        }
    } else {
        answer = await ask(`What happened? (a: stuck on paying, b: wrong modal, c: other)`);
        let reason = 'User reported issue';
        if (answer === 'a') reason = 'Stuck on "Pagando"';
        else if (answer === 'b') reason = 'Wrong modal shown';
        results.push({ step: 'STEP 1', ok: false, reason });
        log(`RESULT: FAIL - ${reason}`);
    }

    // STEP 2
    log(`============================================================`);
    log(`STEP 2: CHANGE NUMBER (9 -> 6)`);
    log(`============================================================`);
    log(`Instructions:`);
    log(`1. Select number 6 on the clock`);
    log(`2. Click APOSTAR`);
    log(`3. EXPECTED: ChangeNumberModal appears`);
    log(`4. Click CAMBIAR`);
    log(`5. EXPECTED: InvoiceModal appears`);
    log(`6. Pay invoice in your wallet`);
    log(`7. Click "Verificar pago" until confirmed`);

    answer = await ask(`Did ChangeNumberModal appear first? (y/n)`);
    log(`User answered: ${answer}`);
    
    if (answer !== 'y') {
        results.push({ step: 'STEP 2', ok: false, reason: 'ChangeNumberModal did not appear' });
        log(`RESULT: FAIL - ChangeNumberModal did not appear`);
    } else {
        answer = await ask(`Did InvoiceModal appear after clicking CAMBIAR? (y/n)`);
        log(`User answered: ${answer}`);
        
        if (answer !== 'y') {
            results.push({ step: 'STEP 2', ok: false, reason: 'InvoiceModal did not appear after confirm' });
            log(`RESULT: FAIL - InvoiceModal did not appear after confirm`);
        } else {
            answer = await ask(`Did you complete the payment? (y/n)`);
            log(`User answered: ${answer}`);
            
            if (answer === 'y') {
                const allBets = await getBetsForBlock(targetBlock);
                const userPubkey = await ask(`Enter your pubkey again:`);
                const userBets = allBets.filter(b => b.pubkey.toLowerCase() === userPubkey.toLowerCase());
                const paidBet6 = userBets.find(b => b.selected_number === 6 && b.is_paid);
                
                if (paidBet6) {
                    results.push({ step: 'STEP 2', ok: true });
                    log(`RESULT: OK - Bet for number 6 is PAID`);
                } else {
                    log(`WARNING: Could not verify payment in DB`);
                    answer = await ask(`Is your bet for number 6 shown as PAID in the app? (y/n)`);
                    if (answer === 'y') {
                        results.push({ step: 'STEP 2', ok: true });
                        log(`RESULT: OK - User confirmed bet is paid`);
                    } else {
                        results.push({ step: 'STEP 2', ok: false, reason: 'Payment not confirmed' });
                        log(`RESULT: FAIL - Payment not confirmed`);
                    }
                }
            } else {
                results.push({ step: 'STEP 2', ok: false, reason: 'User did not complete payment' });
                log(`RESULT: FAIL - User did not complete payment`);
            }
        }
    }

    // STEP 3
    const step2Success = results.find(r => r.step === 'STEP 2')?.ok === true;
    const step3Number = step2Success ? 6 : 9;
    
    log(`============================================================`);
    log(`STEP 3: SAME NUMBER (${step3Number} again)`);
    log(`============================================================`);
    log(`Based on Step 2 result: ${step2Success ? 'bet changed to 6' : 'bet still on 9'}`);
    log(`Instructions:`);
    log(`1. Select number ${step3Number} again`);
    log(`2. Click APOSTAR`);
    log(`3. EXPECTED: InvoiceModal appears DIRECTLY (no ChangeNumberModal)`);
    log(`4. Pay invoice in your wallet`);
    log(`5. Click "Verificar pago" until confirmed`);

    answer = await ask(`Did InvoiceModal appear DIRECTLY? (y/n)`);
    log(`User answered: ${answer}`);
    
    if (answer !== 'y') {
        answer = await ask(`What appeared? (a: ChangeNumberModal, b: nothing, c: other)`);
        let reason = 'Wrong behavior';
        if (answer === 'a') reason = 'ChangeNumberModal appeared incorrectly';
        else if (answer === 'b') reason = 'Nothing appeared';
        results.push({ step: 'STEP 3', ok: false, reason });
        log(`RESULT: FAIL - ${reason}`);
    } else {
        answer = await ask(`Did you complete the payment? (y/n)`);
        log(`User answered: ${answer}`);
        
        if (answer === 'y') {
            const allBets = await getBetsForBlock(targetBlock);
            const userPubkey = await ask(`Enter your pubkey again:`);
            const userBets = allBets.filter(b => b.pubkey.toLowerCase() === userPubkey.toLowerCase());
            const paidBetsSameNumber = userBets.filter(b => b.selected_number === step3Number && b.is_paid);
            log(`Found ${paidBetsSameNumber.length} PAID bet(s) for number ${step3Number}`);
            
            if (paidBetsSameNumber.length >= 2) {
                results.push({ step: 'STEP 3', ok: true });
                log(`RESULT: OK - ${paidBetsSameNumber.length} paid bets for number ${step3Number}`);
            } else {
                results.push({ step: 'STEP 3', ok: false, reason: `Only ${paidBetsSameNumber.length} paid bet(s) for ${step3Number}` });
                log(`RESULT: FAIL - Only ${paidBetsSameNumber.length} paid bet(s) for ${step3Number}`);
            }
        } else {
            results.push({ step: 'STEP 3', ok: false, reason: 'User did not complete payment' });
            log(`RESULT: FAIL - User did not complete payment`);
        }
    }

    // SUMMARY
    log(`============================================================`);
    log(`SUMMARY`);
    log(`============================================================`);
    
    for (const r of results) {
        const icon = r.ok ? '[OK]' : '[FAIL]';
        log(`${icon} ${r.step}${r.reason ? ` - ${r.reason}` : ''}`);
    }
    
    const failed = results.filter(r => !r.ok).length;
    log(`${failed} failed, ${results.filter(r => r.ok).length} passed`);
    log(`Log file: ${LOG_FILE}`);
    log(`Test completed. Full log: ${LOG_FILE}`);
}

main().catch((e: any) => {
    log(`ERROR: Test crashed: ${e.message}`);
    console.error(e);
});
