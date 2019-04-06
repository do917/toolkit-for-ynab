import React, { Component } from 'react';
import { Slider, Rail, Handles, Tracks, Ticks } from 'react-compound-slider';
import { SliderRail, Handle, Track, Tick } from './components';

const sliderStyle = {
  position: 'relative',
  width: '100%',
};

const domain = [100, 500];
const defaultValues = [0, 1, 2];

export class RangeSlider extends Component {
  state = {
    values: defaultValues.slice(),
    update: defaultValues.slice(),
  };

  calculateDomain() {
    const { begGoalDate, endGoalDate } = this.props.values;
    const min = 0;
    const max = endGoalDate.diff(begGoalDate, 'months');

    if (max - min > 0) {
      return [min, max];
    }

    return [0, 1];
  }

  onUpdate = update => {
    this.setState({ update });
  };

  onChange = values => {
    this.setState({ values });
  };

  render() {
    const {
      state: { values, update },
    } = this;

    return (
      <div style={{ height: 120, width: '100%' }}>
        <Slider
          mode={(curr, next) => {
            debugger;
            for (let i = 0; i < curr.length; i++) {
              if (curr[i].key !== next[i].key) {
                return curr;
              }

              if (next[i + 1] && next[i].val === next[i + 1].val) {
                return curr;
              }
            }

            return next;
          }}
          step={1}
          domain={this.calculateDomain()}
          rootStyle={sliderStyle}
          onUpdate={this.onUpdate}
          onChange={this.onChange}
          values={values}
        >
          <Rail>{({ getRailProps }) => <SliderRail getRailProps={getRailProps} />}</Rail>
          <Handles>
            {({ handles, getHandleProps }) => (
              <div className="slider-handles">
                {handles.map(handle => (
                  <Handle
                    key={handle.id}
                    handle={handle}
                    domain={this.calculateDomain()}
                    getHandleProps={getHandleProps}
                  />
                ))}
              </div>
            )}
          </Handles>
          <Tracks left={false} right={false}>
            {({ tracks, getTrackProps }) => (
              <div className="slider-tracks">
                {tracks.map(({ id, source, target }) => (
                  <Track key={id} source={source} target={target} getTrackProps={getTrackProps} />
                ))}
              </div>
            )}
          </Tracks>
          <Ticks count={5}>
            {({ ticks }) => (
              <div className="slider-ticks">
                {ticks.map(tick => (
                  <Tick key={tick.id} tick={tick} count={ticks.length} />
                ))}
              </div>
            )}
          </Ticks>
        </Slider>
      </div>
    );
  }
}
