import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Collections } from 'toolkit/extension/utils/collections';
import {
  getFirstMonthOfBudget,
  getLastMonthOfBudget,
  getToday,
} from 'toolkit/extension/utils/date';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';
import { l10nMonth } from 'toolkit/extension/utils/toolkit';

export class GoalsComponent extends React.Component {
  _masterCategoriesCollection = Collections.masterCategoriesCollection;
  _subCategoriesCollection = Collections.subCategoriesCollection;
  _monthlySubCategoryBudgetCalculationsCollection =
    Collections.monthlySubCategoryBudgetCalculationsCollection;

  static propTypes = {
    filters: PropTypes.shape(FiltersPropType),
    filteredTransactions: PropTypes.array.isRequired,
  };

  get firstMonthOfBudget() {
    return getFirstMonthOfBudget();
  }

  get lastMonthOfBudget() {
    return getLastMonthOfBudget();
  }

  state = {
    selectedToMonth: getToday().getMonth(),
    selectedToYear: getToday().getYear(),
  };

  componentDidMount() {
    this._setCategoriesData();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.filteredTransactions !== prevProps.filteredTransactions) {
      this._setCategoriesData();
    } else if (
      this.state.selectedToMonth !== prevState.selectedToMonth ||
      this.state.selectedToYear !== prevState.selectedToYear
    ) {
      this._calculateChartData();
    }
  }

  render() {
    return (
      <div className="tk-flex tk-flex-column tk-flex-grow">
        <div className="tk-flex tk-justify-content-center">{this._renderSelector()}</div>
        <div className="tk-highcharts-report-container" id="tk-goals" />
      </div>
    );
  }

  _getEligibleMonths(selectedYear) {
    const date = new ynab.utilities.DateWithoutTime();
    date.startOfYear().setYear(selectedYear);
    const options = [];
    // HTML values are converted to string and that's what's stored in state so
    // we need to convert `.getYear()` into a string.
    while (date.getYear().toString() === selectedYear.toString()) {
      options.push({
        disabled: date.isAfter(this.lastMonthOfBudget) || date.isBefore(this.firstMonthOfBudget),
        month: date.getMonth(),
      });
      date.addMonths(1);
    }

    return options;
  }

  _renderEligibleMonths(selectedYear) {
    const eligibleMonths = this._getEligibleMonths(selectedYear);
    return eligibleMonths.map(({ disabled, month }) => (
      <option key={month} disabled={disabled} value={month}>
        {l10nMonth(month)}
      </option>
    ));
  }

  _renderEligibleYears() {
    const today = getToday();
    const date = getFirstMonthOfBudget();

    const options = [];
    while (date.getYear() <= today.getYear()) {
      options.push(
        <option key={date.getYear()} value={date.getYear()}>
          {date.getYear()}
        </option>
      );

      date.addYears(1);
    }

    return options;
  }

  _handleToMonthSelected = ({ currentTarget }) => {
    this.setState({ selectedToMonth: currentTarget.value });
  };

  _handleToYearSelected = ({ currentTarget }) => {
    this.setState({ selectedToYear: currentTarget.value });
  };

  _renderSelector() {
    return (
      <div>
        <select
          className="tk-date-filter__select"
          value={this.state.selectedToMonth}
          onChange={this._handleToMonthSelected}
        >
          {this._renderEligibleMonths(this.state.selectedToYear)}
        </select>
        <select
          className="tk-date-filter__select tk-mg-l-05"
          value={this.state.selectedToYear}
          onChange={this._handleToYearSelected}
        >
          {this._renderEligibleYears()}
        </select>
      </div>
    );
  }

  _setCategoriesData() {
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
          subCategory.goalCreatedOn &&
          subCategory.goalTargetDate &&
          subCategory.goalType === 'TBD'
        ) {
          categoriesWithGoals.push(subCategory);
        }
      });
    });

    this.setState({ categoriesWithGoals }, this._renderReport);
  }

  _calculateChartData = () => {
    const { categoriesWithGoals, chart, selectedToMonth, selectedToYear } = this.state;

    if (!chart || !chart.hasRendered) {
      return;
    }

    const begGoalDate = moment.min(
      categoriesWithGoals.map(category => category.goalCreatedOn.toUTCMoment())
    );

    const selectedDate = new ynab.utilities.DateWithoutTime()
      .setMonth(selectedToMonth)
      .setYear(selectedToYear)
      .format('YYYY-MM');

    const goalsProgress = categoriesWithGoals.map(category => {
      const categoryLookupPrefixCid = `mcbc/${selectedDate}/${category.entityId}`;
      const percentage =
        (1 / 100) *
        this._monthlySubCategoryBudgetCalculationsCollection.findItemByEntityId(
          categoryLookupPrefixCid
        ).goalPercentageComplete;

      const totalGoalLengthInMonths = category.goalTargetDate
        .toUTCMoment()
        .diff(category.goalCreatedOn.toUTCMoment(), 'months');

      const goalCompleted = percentage * totalGoalLengthInMonths;
      const goalLeft = (1 - percentage) * totalGoalLengthInMonths;

      return { goalCompleted, goalLeft };
    });

    const goalLeft = goalsProgress.map(categ => categ.goalLeft);
    const goalCompleted = goalsProgress.map(categ => categ.goalCompleted);
    const seriesStartBuffer = categoriesWithGoals.map(category => {
      return category.goalCreatedOn.toUTCMoment().diff(begGoalDate, 'months');
    });

    chart.series[0].setData(goalLeft);
    chart.series[1].setData(goalCompleted);
    chart.series[2].setData(seriesStartBuffer);
  };

  _renderReport = () => {
    const { categoriesWithGoals } = this.state;

    const begGoalDate = moment.min(
      categoriesWithGoals.map(category => category.goalCreatedOn.toUTCMoment())
    );

    if (this.state.chart && this.state.chart.hasRendered) {
      console.log('destroying chart');
      this.state.chart.destroy();
    }

    const chart = new Highcharts.Chart({
      chart: {
        type: 'bar',
        renderTo: 'tk-goals',
      },
      title: {
        text: 'Stacked bar chart',
      },
      xAxis: {
        categories: categoriesWithGoals.map(category => category.name),
      },
      yAxis: {
        min: 0,
        title: {
          text: 'Total fruit consumption',
        },
        tickInterval: 1,
        labels: {
          formatter: function() {
            console.log('yo this is this', this, arguments);
            console.log('yo this is beg date should be same', begGoalDate.format('MMM'));

            return begGoalDate
              .clone()
              .add(this.value, 'months')
              .format('MMM');
            // return this.value + ' %';
          },
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
          data: [],
          color: '#D6D6D6',
        },
        {
          name: 'progress',
          data: [],
          color: '#5cb85c',
        },
        {
          name: 'seriesStartBuffer',
          color: 'rgba(0, 0, 0, 0)',
          data: [],
        },
      ],
    });

    this.setState({ chart }, this._calculateChartData);
  };
}
