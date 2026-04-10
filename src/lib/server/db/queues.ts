import { Queue } from 'bullmq';

export const replyQueue = new Queue('reply');
export const correctionQueue = new Queue('correct');
