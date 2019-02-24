const Promise = require('./index');
const test = require('promises-aplus-tests');

const adapter = {
    resolved: Promise.resolve,
    rejected: Promise.reject,
    deferred: function() {
        const deferred = {};
        deferred.promise = new Promise(function(resolve, reject) {
            deferred.resolve = resolve;
            deferred.reject = reject; 
        });
        return deferred;
    }
};

test(adapter);
