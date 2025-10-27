import type { PrismaClient } from '@prisma/client';

import { db } from '@/lib/data/db';

export const prisma: PrismaClient = db;
