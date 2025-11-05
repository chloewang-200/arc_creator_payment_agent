import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

export function SubscriptionBadge() {
  return (
    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Included in subscription
    </Badge>
  );
}
