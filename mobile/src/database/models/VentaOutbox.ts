import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class VentaOutbox extends Model {
  static table = 'ventas_outbox';

  @field('payload') payload!: string;
  @field('status') status!: 'pending' | 'synced' | 'error';
  @readonly @date('created_at') createdAt!: Date;
  @date('synced_at') syncedAt?: Date | null;
  @field('error_message') errorMessage?: string | null;
  @field('retry_count') retryCount?: number | null;
}
