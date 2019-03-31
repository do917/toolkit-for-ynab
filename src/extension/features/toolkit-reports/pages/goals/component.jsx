import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Collections } from 'toolkit/extension/utils/collections';
import { formatCurrency } from 'toolkit/extension/utils/currency';
import { localizedMonthAndYear, sortByGettableDate } from 'toolkit/extension/utils/date';
import { l10n } from 'toolkit/extension/utils/toolkit';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';

export class GoalsComponent extends React.Component {
  _masterCategoriesCollection = Collections.masterCategoriesCollection;
  _subCategoriesCollection = Collections.subCategoriesCollection;
  _monthlySubCategoryBudgetCalculationsCollection =
    Collections.monthlySubCategoryBudgetCalculationsCollection;

  static propTypes = {
    filters: PropTypes.shape(FiltersPropType),
    filteredTransactions: PropTypes.array.isRequired,
    allReportableTransactions: PropTypes.array.isRequired,
  };

  state = {};

  componentDidMount() {
    this._calculateData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.filteredTransactions !== prevProps.filteredTransactions) {
      this._calculateData();
    }
  }

  render() {
    return (
      <div className="tk-flex tk-flex-grow">
        <div className="tk-highcharts-report-container" id="tk-goals" />
      </div>
    );
  }

  _calculateData() {
    const { categoryFilterIds } = this.props.filters;
    const categoriesWithGoals = [];

    this._masterCategoriesCollection.forEach(masterCategory => {
      const { entityId: masterCategoryId } = masterCategory;
      if (
        masterCategory.isTombstone ||
        masterCategory.isDebtPaymentMasterCategory() ||
        masterCategory.isInternalMasterCategory()
      ) {
        return;
      }

      const isHiddenMasterCategory = masterCategory.isHiddenMasterCategory();
      const subCategories = this._subCategoriesCollection.findItemsByMasterCategoryId(
        masterCategoryId
      );
      if (!subCategories) {
        return;
      }

      const areAllSubCategoriesIgnored = subCategories.every(({ entityId }) =>
        categoryFilterIds.has(entityId)
      );

      subCategories.forEach(subCategory => {
        const { entityId: subCategoryId } = subCategory;
        if (subCategory.isTombstone || (subCategory.internalName && !isHiddenMasterCategory)) {
          return;
        }

        if (
          !this.props.filters.categoryFilterIds.has(subCategoryId) &&
          subCategory.goalCreationMonth &&
          subCategory.targetBalanceMonth &&
          subCategory.goalType === 'TBD'
        ) {
          categoriesWithGoals.push(subCategory);
        }
      });
    });

    const firstGoalDate = moment.min(
      categoriesWithGoals.map(category => category.goalCreationMonth.toUTCMoment())
    );
    const lastGoalDate = moment.max(
      categoriesWithGoals.map(category => category.targetBalanceMonth.toUTCMoment())
    );

    const categoryNames = categoriesWithGoals.map(category => category.name);

    const seriesStartBuffer = categoriesWithGoals.map(category => {
      return category.goalCreationMonth.toUTCMoment().diff(firstGoalDate, 'months');
    });
    const goalsProgress = categoriesWithGoals.map(category => {
      const categoryLookupPrefixCid = `mcbc/2019-04/${category.entityId}`;
      const percentage =
        (1 / 100) *
        this._monthlySubCategoryBudgetCalculationsCollection.findItemByEntityId(
          categoryLookupPrefixCid
        ).goalPercentageComplete;

      const totalGoalLengthInMonths = category.targetBalanceMonth
        .toUTCMoment()
        .diff(category.goalCreationMonth.toUTCMoment(), 'months');

      const goalCompleted = percentage * totalGoalLengthInMonths;
      const goalLeft = (1 - percentage) * totalGoalLengthInMonths;

      return { goalCompleted, goalLeft };
    });

    this.setState(
      {
        reportData: {
          categoryNames,
          seriesStartBuffer,
          goalCompleted: goalsProgress.map(categ => categ.goalCompleted),
          goalLeft: goalsProgress.map(categ => categ.goalLeft),
        },
      },
      this._renderReport
    );
  }

  _renderReport = () => {
    const chart = new Highcharts.Chart({
      chart: {
        type: 'bar',
        renderTo: 'tk-goals',
      },
      title: {
        text: 'Stacked bar chart',
      },
      xAxis: {
        categories: this.state.reportData.categoryNames,
      },
      yAxis: {
        min: 0,
        title: {
          text: 'Total fruit consumption',
        },
      },
      legend: {
        reversed: true,
      },
      plotOptions: {
        series: {
          stacking: 'normal',
        },
      },
      series: [
        {
          name: 'progress left',
          data: this.state.reportData.goalLeft,
          color: '#D6D6D6',
        },
        {
          name: 'progress',
          data: this.state.reportData.goalCompleted,
          color: '#5cb85c',
        },
        {
          name: 'seriesStartBuffer',
          color: 'rgba(0, 0, 0, 0)',
          data: this.state.reportData.seriesStartBuffer,
        },
      ],
    });

    this.setState({ chart });
  };
}
