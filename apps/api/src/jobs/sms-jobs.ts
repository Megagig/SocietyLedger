import cron from 'node-cron';
import { recoverInterruptedSends } from '../modules/sms/sms-engine';

/**
 * A server that stops in the middle of a big send leaves texts pending for ever and their credits spent. Every few minutes this finds
 * texts that have been pending too long, marks them failed, gives their credits back, and marks the campaign or announcement as
 * interrupted. Sends still under way are younger than that, so it never touches them.
 */
const recoverStaleSends = cron.schedule('*/5 * * * *', async () => {
  try {
    const { messages, credits } = await recoverInterruptedSends();
    if (messages > 0) console.log(`✓ SMS recovery: ${messages} interrupted text${messages === 1 ? '' : 's'} failed, ${credits} credit${credits === 1 ? '' : 's'} refunded`);
  } catch (error) {
    console.error('SMS recovery failed:', error);
  }
});

export function startSmsJobs() {
  recoverStaleSends.start();
  console.log('✓ SMS recovery job started (runs every 5 minutes)');
  // Once at start-up as well, so a restart cleans up after itself without waiting for the first tick.
  void recoverInterruptedSends().catch((error) => console.error('SMS recovery at start-up failed:', error));
}

export function stopSmsJobs() {
  recoverStaleSends.stop();
}
