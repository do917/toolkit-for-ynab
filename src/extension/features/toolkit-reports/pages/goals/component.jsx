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
        new skeleton steup
        <div className="tk-highcharts-report-container" id="tk-goals" />
      </div>
    );
  }

  _calculateData() {
    const { categoryFilterIds } = this.props.filters;
    const categoriesWithGoals = new Map();
    const categoriesList = [];
    const garbage = [];

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
          subCategory.goalCreationMonth &&
          (subCategory.goalType === 'TB' || subCategory.goalType === 'TBD')
        ) {
          categoriesList.push(subCategoryId);
          garbage.push(subCategory);
          categoriesWithGoals.set(
            subCategory.name,
            subCategory.goalCreationMonth && subCategory.goalCreationMonth.getMonth()
          );
        }
      });
    });

    this.setState({}, this._renderReport);
  }

  _renderReport = () => {
    const chart = new Highcharts.Chart({
      credits: false,
      chart: {
        height: '70%',
        type: 'column',
        inverted: true,
        renderTo: 'tk-goals',
      },

      title: {
        text: 'Temperature variation by month',
      },

      subtitle: {
        text: 'Observed in Vik i Sogn, Norway, 2017',
      },

      xAxis: {
        categories: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },

      yAxis: {
        title: {
          text: 'Temperature ( °C )',
        },
      },

      tooltip: {
        valueSuffix: '°C',
      },

      plotOptions: {
        columnrange: {
          dataLabels: {
            enabled: true,
            format: '{y}°C',
          },
        },
      },

      series: [
        {
          name: 'Temperatures',
          data: [
            [-9.9, 10.3],
            [-8.6, 8.5],
            [-10.2, 11.8],
            [-1.7, 12.2],
            [-0.6, 23.1],
            [3.7, 25.4],
            [6.0, 26.2],
            [6.7, 21.4],
            [3.5, 19.5],
            [-1.3, 16.0],
            [-8.7, 9.4],
            [-9.0, 8.6],
          ],
        },
      ],
    });

    this.setState({ chart });
  };
}
