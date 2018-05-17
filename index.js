const fs = require('fs');
const async = require('async');
const _ = require('lodash');
const Benchmark = require('benchmark');
const beauty = require('beautify-benchmark');

const NpmPromise = require('promise');
const NpmBluebirdPromise = require("bluebird");
const RSVP = require('rsvp');
const Q = require('q');

const benchmarks = {
  'while by linked objects': (count) => {
    const start = { listener: next => next(), next: null };
    let last = start;
    _.times(count, () => {
      const next = { listener: next => next(), next: null };
      last.next = next;
      last = next;
    });
    return {
      fn(defer) {
        let t = 0;
        const next = () => {
          t++;
          if (t === count) defer.resolve();
        }
        let pointer = start;
        while (pointer.next) {
          pointer.listener(next);
          pointer = pointer.next;
        }
      },
      defer: true,
    };
  },
  'for by array': (count) => {
    const tasks = _.times(count, () => (next) => next());
    return {
      fn(defer) {
        let t = 0;
        const next = () => {
          t++;
          if (t === count) defer.resolve();
        }
        for (let i = 0; t < count; i++) {
          tasks[i](next);
        }
      },
      defer: true,
    };
  },
  'async.parallel': (count) => {
    const tasks = _.times(count, () => (next) => next());
    return {
      fn(defer) {
        async.parallel(tasks, () => defer.resolve());
      },
      defer: true,
    };
  },
  'build-in promise all': (count) => {
    return {
      fn(defer) {
        const tasks = _.times(count, () => new Promise(resolve => resolve()));
        Promise.all(tasks)
        .then(() => defer.resolve());
      },
      defer: true,
    };
  },
};

const createSuite = (benchmarks, count) => {
  const suite = new Benchmark.Suite();
  for (let t in benchmarks) suite.add(t, benchmarks[t](count));
  return suite;
};

const createSuites = (benchmarks) => {
  return {
    '10 items': createSuite(benchmarks, 10),
    '100 items': createSuite(benchmarks, 100),
    '250 items': createSuite(benchmarks, 250),
    '500 items': createSuite(benchmarks, 500),
    '1000 items': createSuite(benchmarks, 1000),
    '5000 items': createSuite(benchmarks, 5000),
    '10000 items': createSuite(benchmarks, 10000),
  };
};

const suites = createSuites(benchmarks);

const launch = (suites) => {
  async.eachSeries(
    _.keys(suites),
    (suiteName, next) => {
      console.log(suiteName);
      suites[suiteName].on('cycle', (event) => beauty.add(event.target));
      suites[suiteName].on('complete', (event) => {
        beauty.log();
        next();
      });
      suites[suiteName].run({ async: true });
    },
  );
};

module.exports = {
  benchmarks,
  createSuite,
  createSuites,
  suites,
  launch,
};
