import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { Collections } from 'toolkit/extension/utils/collections';
import { getFirstMonthOfBudget, getToday } from 'toolkit/extension/utils/date';
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

  state = {
    selectedToMonth: getToday().getMonth(),
    selectedToYear: getToday().getYear(),
  };

  componentDidMount() {
    this._calculateData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.filteredTransactions !== prevProps.filteredTransactions) {
      this._calculateData();
    }
  }

  _getEligibleMonths(selectedYear) {
    const today = getToday();
    const date = new ynab.utilities.DateWithoutTime();
    date.startOfYear().setYear(selectedYear);
    const options = [];
    // HTML values are converted to string and that's what's stored in state so
    // we need to convert `.getYear()` into a string.
    while (date.getYear().toString() === selectedYear.toString()) {
      options.push({
        disabled: date.isAfter(today) || date.isBefore(this.firstMonthOfBudget),
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

  render() {
    return (
      <div className="tk-flex tk-flex-column tk-flex-grow">
        <div className="tk-flex tk-justify-content-center">{this._renderSelector()}</div>
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
          subCategory.goalCreatedOn &&
          subCategory.goalTargetDate &&
          subCategory.goalType === 'TBD'
        ) {
          categoriesWithGoals.push(subCategory);
        }
      });
    });

    this.setState(
      {
        categoriesWithGoals,
      },
      this._renderReport
    );
  }

  _renderReport = () => {
    const { categoriesWithGoals } = this.state;

    const begGoalDate = moment.min(
      categoriesWithGoals.map(category => category.goalCreatedOn.toUTCMoment())
    );

    const seriesStartBuffer = categoriesWithGoals.map(category => {
      return category.goalCreatedOn.toUTCMoment().diff(begGoalDate, 'months');
    });

    const goalsProgress = categoriesWithGoals.map(category => {
      const categoryLookupPrefixCid = `mcbc/2019-02/${category.entityId}`;
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

    const categoryNames = categoriesWithGoals.map(category => category.name);
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

    this.setState({
      chart,
    });
  };
}
