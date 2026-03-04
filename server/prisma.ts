import { PrismaClient } from './generated/prisma/client.js';

const prisma = new PrismaClient({} as any);

export default prisma;
