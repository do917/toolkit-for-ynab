export * from './container';
import { withReportContext } from 'toolkit-reports/common/components/report-context';
import { GoalsComponent } from './component';

function mapReportContextToProps(context) {
  return {
    filters: context.filters,
    filteredTransactions: context.filteredTransactions,
  };
}

export const Goals = withReportContext(mapReportContextToProps)(GoalsComponent);
