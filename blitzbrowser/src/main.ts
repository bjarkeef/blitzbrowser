import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs-extra';
import * as path from 'path';

const package_json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')).toString('utf8'));
const logger = new Logger();

logger.log('#########################################################');
logger.log(`# Version: ${package_json.version}`);
logger.log(`# Website: https://docs.blitzbrowser.com`);
logger.log(`# Github : https://github.com/blitzbrowser/blitzbrowser`);
logger.log(`# Discord: https://discord.com/invite/qZ3tCZJ2Ze`);
logger.log('#########################################################');

async function bootstrap() {
  // Without API_KEY the guard lets every request in. Refuse to start instead
  // of silently opening CDP and the management API to anyone who can reach us.
  if (!process.env.API_KEY && process.env.ALLOW_NO_API_KEY !== 'true') {
    logger.error('API_KEY is not set. Set it, or ALLOW_NO_API_KEY=true for a trusted local network.');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  
  app.enableCors();

  await app.listen(process.env.PORT || 9999, '0.0.0.0');
}

bootstrap();
