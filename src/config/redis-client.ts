import { Redis } from '@upstash/redis';
// import { createClient } from 'redis';
import { InternalServerError } from '../utils/error.utils.js';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

let redisClient: Redis;

export const initRedis = async () => {
    try {
        redisClient = new Redis({
            url: process.env.REDIS_URL,
            token: process.env.REDIS_TOKEN,
        })

        // redisClient = createClient({
        //     url: process.env.REDIS_URL,
        // });

        // redisClient.on('error', (err) => {
        //     console.error('Redis Client Error', err);
        // });

        // redisClient.on('connect', () => {
        //     console.log('Redis connected successfully');
        // });

        // await redisClient.connect();

        console.log('Redis client initialized successfully');
    } catch (error: any) {
        console.error('Redis connection failed:', error.message);
        process.exit(1);
    }
};

export const getRedisClient = () => {
    if (!redisClient) {
        throw new InternalServerError('Redis client not initialized.');
    }

    return redisClient;
};