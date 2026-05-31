import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BrowserInstance } from 'src/components/browser-instance.component';
import * as EventEmitter from 'events';
import { ModuleRef } from '@nestjs/core';
import { MaxBrowserReachedError } from 'src/errors/max-browser-reached.error';
import { findStaleInstanceIds } from './browser-reaper.util';

type PoolServiceEvents = {
  browser_instance_created: [BrowserInstance];
}

export interface BrowserPoolInstanceInfo {
  id: string;
  created_at: string;
  age_ms: number;
  in_use: boolean;
}

export interface BrowserPoolStatus {
  id: string;
  started_at: string;
  max_browser_instances: number;
  tags: { [key: string]: string; };
  active_instances: number;
  oldest_age_ms: number | null;
  instances: BrowserPoolInstanceInfo[];
}

@Injectable()
export class BrowserPoolService extends EventEmitter<PoolServiceEvents> implements OnModuleInit {

  private readonly logger = new Logger(BrowserPoolService.name);

  readonly #id: string = crypto.randomUUID();
  readonly #started_at = new Date().toISOString();
  readonly #tags: { [key: string]: string; } = {};

  readonly max_browser_instances = parseInt(process.env.MAX_BROWSER_INSTANCES || '99');
  readonly #max_lifetime_ms = parseInt(process.env.BROWSER_MAX_LIFETIME_MS || '3600000');
  readonly #reap_interval_ms = parseInt(process.env.BROWSER_REAP_INTERVAL_MS || '60000');
  #reap_timer: NodeJS.Timeout | undefined;

  readonly #browser_instances = new Map<string, BrowserInstance>();

  #sigterm_received: boolean = false;

  constructor(
    private readonly module_ref: ModuleRef,
  ) {
    super();

    (process.env.TAGS || '').split(',').forEach(tag => {
      const [key, value] = tag.split('=');

      this.#tags[key] = value;
    })
  }

  get status(): BrowserPoolStatus {
    const now = Date.now();
    const instances: BrowserPoolInstanceInfo[] = this.browser_instances.map((i) => ({
      id: i.id,
      created_at: i.created_at,
      age_ms: now - new Date(i.created_at).getTime(),
      in_use: i.in_use,
    }));
    return {
      id: this.#id,
      started_at: this.#started_at,
      max_browser_instances: this.max_browser_instances,
      tags: this.#tags,
      active_instances: instances.length,
      oldest_age_ms: instances.length > 0 ? instances.reduce((max, i) => Math.max(max, i.age_ms), 0) : null,
      instances,
    };
  }

  get id() {
    return this.#id;
  }

  get started_at() {
    return this.#started_at;
  }

  get tags() {
    return this.#tags;
  }

  get sigterm_received() {
    return this.#sigterm_received;
  }

  get nb_browser_instances_alive() {
    return this.#browser_instances.size;
  }

  get browser_instances() {
    return [...this.#browser_instances.values()]
  }

  async onModuleInit() {
    process.on('SIGTERM', () => {
      this.logger.log('SIGTERM received');
      this.shutdown();
    });

    if (this.#max_lifetime_ms > 0) {
      this.logger.log(
        `Max-lifetime reaper enabled: ${this.#max_lifetime_ms}ms cap, sweeping every ${this.#reap_interval_ms}ms.`,
      );
      this.#reap_timer = setInterval(() => this.reapStaleInstances(), this.#reap_interval_ms);
      this.#reap_timer.unref();
    }
  }

  getBrowserInstanceById(id: string): BrowserInstance | undefined {
    return this.#browser_instances.get(id);
  }

  reapStaleInstances() {
    const staleIds = findStaleInstanceIds(
      this.browser_instances.map((i) => ({ id: i.id, created_at: i.created_at, in_use: i.in_use })),
      Date.now(),
      this.#max_lifetime_ms,
    );
    for (const id of staleIds) {
      const instance = this.getBrowserInstanceById(id);
      if (!instance) continue;
      this.logger.warn(
        `Reaping stale browser instance ${id} (exceeded max lifetime ${this.#max_lifetime_ms}ms).`,
      );
      void instance.close();
    }
  }

  createBrowserInstance(id: string = crypto.randomUUID()) {
    if (this.sigterm_received) {
      this.logger.log(`Can't create new browser instance. Sigterm has been received.`);
      return;
    }

    if(this.#browser_instances.size === this.max_browser_instances) {
      throw new MaxBrowserReachedError();
    }

    const browser_instance = new BrowserInstance(id, this.module_ref);

    this.logger.log(`Created browser instance ${browser_instance.id}.`);

    browser_instance.on('terminated', () => {
      this.logger.log(`Browser instance ${browser_instance.id} terminated. Removing from pool.`);
      this.#browser_instances.delete(browser_instance.id);
    });

    this.#browser_instances.set(browser_instance.id, browser_instance);

    this.emit('browser_instance_created', browser_instance);

    return browser_instance;
  }

  async shutdown() {
    if (this.#sigterm_received) {
      return;
    }

    this.#sigterm_received = true;

    if (this.#reap_timer) {
      clearInterval(this.#reap_timer);
      this.#reap_timer = undefined;
    }

    this.logger.log('Shutdown requested.');

    for (const browser_instance of this.#browser_instances.values()) {
      if (browser_instance.in_use) {
        continue;
      }

      await browser_instance.close();
    }

    setInterval(async () => {
      if (this.#browser_instances.size !== 0) {
        this.logger.log(`Waiting for ${this.#browser_instances.size} browser instance(s) to close.`);
        return;
      }

      this.logger.log(`All browser instances are closed.`);

      process.exit(0);
    }, 200);
  }

}
