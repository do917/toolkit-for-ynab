import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Collections } from 'toolkit/extension/utils/collections';
import { getToday } from 'toolkit/extension/utils/date';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';

import { RangeSlider } from './components/slider';

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

  state = {
    begGoalDate: getToday().toUTCMoment(),
    endGoalDate: getToday().toUTCMoment(),
    currGoalDate: getToday().toUTCMoment(),
  };

  componentDidMount() {
    this._calculateData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.filteredTransactions !== prevProps.filteredTransactions) {
      this._calculateData();
    }
  }

  render() {
    const { begGoalDate, endGoalDate, currGoalDate } = this.state;
    return (
      <div className="tk-flex tk-flex-column tk-flex-grow">
        <div className="tk-flex tk-justify-content-center">blah</div>
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

      subCategories.forEach(subCategory => {
        const { entityId: subCategoryId } = subCategory;
        if (subCategory.isTombstone || (subCategory.internalName && !isHiddenMasterCategory)) {
          return;
        }

        if (
          !categoryFilterIds.has(subCategoryId) &&
          subCategory.goalCreationMonth &&
          subCategory.targetBalanceMonth &&
          subCategory.goalType === 'TBD'
        ) {
          console.log('this should be here', subCategory);
          categoriesWithGoals.push(subCategory);
        }
      });
    });

    const begGoalDate = moment.min(
      categoriesWithGoals.map(category => category.goalCreationMonth.toUTCMoment())
    );
    const endGoalDate = moment.max(
      categoriesWithGoals.map(category => category.targetBalanceMonth.toUTCMoment())
    );

    this.setState(
      {
        begGoalDate,
        endGoalDate,
        categoriesWithGoals,
      },
      this._renderReport
    );

    // const categoryNames = categoriesWithGoals.map(category => category.name);

    // const seriesStartBuffer = categoriesWithGoals.map(category => {
    //   return category.goalCreationMonth.toUTCMoment().diff(firstGoalDate, 'months');
    // });
    // const goalsProgress = categoriesWithGoals.map(category => {
    //   const categoryLookupPrefixCid = `mcbc/2019-04/${category.entityId}`;
    //   const percentage =
    //     (1 / 100) *
    //     this._monthlySubCategoryBudgetCalculationsCollection.findItemByEntityId(
    //       categoryLookupPrefixCid
    //     ).goalPercentageComplete;

    //   const totalGoalLengthInMonths = category.targetBalanceMonth
    //     .toUTCMoment()
    //     .diff(category.goalCreationMonth.toUTCMoment(), 'months');

    //   const goalCompleted = percentage * totalGoalLengthInMonths;
    //   const goalLeft = (1 - percentage) * totalGoalLengthInMonths;

    //   return { goalCompleted, goalLeft };
    // });

    // this.setState(
    //   {
    //     reportData: {
    //       categoryNames,
    //       seriesStartBuffer,
    //       goalCompleted: goalsProgress.map(categ => categ.goalCompleted),
    //       goalLeft: goalsProgress.map(categ => categ.goalLeft),
    //     },
    //   },
    //   this._renderReport
    // );
  }

  _renderReport = () => {
    const { categoriesWithGoals, begGoalDate, endGoalDate } = this.state;
    const categoryNames = categoriesWithGoals.map(category => category.name);

    const seriesStartBuffer = categoriesWithGoals.map(category => {
      return category.goalCreationMonth.toUTCMoment().diff(begGoalDate, 'months');
    });

    const goalsProgress = categoriesWithGoals.map(category => {
      const categoryLookupPrefixCid = `mcbc/2019-02/${category.entityId}`;
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

    const goalCompleted = goalsProgress.map(categ => categ.goalCompleted);
    const goalLeft = goalsProgress.map(categ => categ.goalLeft);

    const chart = new Highcharts.Chart({
      chart: {
        type: 'bar',
        renderTo: 'tk-goals',
      },
      title: {
        text: 'Stacked bar chart',
      },
      xAxis: {
        categories: categoryNames,
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
          data: goalLeft,
          color: '#D6D6D6',
        },
        {
          name: 'progress',
          data: goalCompleted,
          color: '#5cb85c',
        },
        {
          name: 'seriesStartBuffer',
          color: 'rgba(0, 0, 0, 0)',
          data: seriesStartBuffer,
        },
      ],
    });
    console.log('comon', categoryNames, seriesStartBuffer, goalCompleted, goalLeft);
    this.setState({
      chart,
      reportData: {
        categoryNames,
        seriesStartBuffer,
        goalCompleted,
        goalLeft,
      },
    });
  };
}
