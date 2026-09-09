export interface ServiceStatus {
  name: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: Date;
}

export interface SystemServiceOptions {
  version: string;
  environment: string;
  startedAt?: Date;
  now?: () => Date;
}

/** Liveness information for health checks and the API landing query. */
export class SystemService {
  private readonly startedAt: Date;
  private readonly now: () => Date;

  constructor(private readonly options: SystemServiceOptions) {
    this.startedAt = options.startedAt ?? new Date();
    this.now = options.now ?? (() => new Date());
  }

  status(): ServiceStatus {
    const timestamp = this.now();
    return {
      name: "campaignpulse-api",
      version: this.options.version,
      environment: this.options.environment,
      uptimeSeconds: Math.max(
        0,
        Math.floor((timestamp.getTime() - this.startedAt.getTime()) / 1000),
      ),
      timestamp,
    };
  }
}
