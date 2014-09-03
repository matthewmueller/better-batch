
var Batch = require('../');
var assert = require('assert');

describe('Batch', function(){
  var batch;

  beforeEach(function(){
    batch = new Batch;
  })

  describe('#end(callback)', function(){
    describe('when no functions are queued', function(){
      it('should invoke the callback', function(done){
        batch.end(done);
      })

      it('should work with undefined', function(done) {
        batch.push(undefined);
        batch.end(done);
      })
    })

    it('construct an array of results in order', function(done){
      batch.push(function(fn){
        setTimeout(function(){
          fn(null, 'foo');
        }, 100);
      });

      batch.push(function(fn){
        setTimeout(function(){
          fn(null, 'bar');
        }, 50);
      });

      batch.end(function(err, res){
        if (err) return done(err);
        res.should.eql(['foo', 'bar']);
        done();
      })
    })

    describe('when several functions are queued', function(){
      it('should invoke the callback', function(done){
        batch.push(function(fn){
          process.nextTick(fn);
        })

        batch.push(function(fn){
          process.nextTick(fn);
        })

        batch.end(done);
      })
    })

    describe('sync', function() {
      it('should support sync functions', function(done) {
        batch.push(function() {
          return 'a';
        })

        batch.push(function() {
          return 'b';
        });

        batch.end(function(err, res) {
          if (err) return done(err);
          assert('a' == res[0]);
          assert('b' == res[1]);
          done();
        })
      })

      it('should propagate errors', function(done) {
        var called = 0;

        batch.push(function() {
          called++;
          return new Error('explosion');
        })

        batch.push(function() {
          called++;
          return 'b';
        });

        batch.end(function(err, res) {
          assert('explosion' == err.message);
          assert(err);
          assert(1 == called);
          done();
        })
      })
    })

    describe('generators', function() {
      it('should support generators', function(done) {
        var called = 0;

        batch.push(function *() {
          yield wait(100)
          called++;
          return 'a';
        })

        batch.push(function *() {
          yield wait(100)
          called++;
          return 'b';
        });

        batch.end(function(err, res) {
          if (err) return done(err);
          assert('a' == res[0]);
          assert('b' == res[1]);
          done();
        })
      })

      it('should propagate errors', function(done) {
        var called = 0;

        batch.push(function *() {
          yield wait(200)
          called++;
          throw new Error('explosion');
        })

        batch.push(function *() {
          yield wait(100)
          called++;
          return 'b';
        });

        batch.end(function(err, res) {
          assert(err);
          assert('explosion' == err.message);
          assert(2 == called);
          done();
        })

      })

      function wait(ms) {
        return function(fn) {
          return setTimeout(fn, ms);
        }
      }
    })

    describe('arguments', function() {
      it('should pass arguments through', function(done) {
        batch.push(function(a, b, fn) {
          assert('a' == a);
          assert('b' == b);
          fn(null, 'a');
        });

        batch.push(function(a, b, fn) {
          assert('a' == a);
          assert('b' == b);
          fn(null, 'b');
        });

        batch.end('a', 'b', function(err, res) {
          assert(!err);
          assert('a' == res[0]);
          assert('b' == res[1]);
          done();
        })
      })
    })

    describe('.concurrency()', function(done) {
      it('should support concurrency', function() {
        var called = 0;
        var done = 0;

        batch.concurrency(2);

        batch.push(function(fn) {
          setTimeout(function() {
            done++;
            fn();
          }, 50);
        })

        batch.push(function(fn) {
          setTimeout(function() {
            done++;
            fn();
          }, 100);
        })

        batch.push(function() {
          setTimeout(function() {
            done++;
            fn();
          }, 50);
        })

        batch.end(function() {
          assert(2 == called);
          done();
        });

        // check at various points
        setTimeout(function() {
          called++;
          assert(1 == done);
        }, 60)

        setTimeout(function() {
          called++;
          assert(3 == done);
        }, 110)
      });
    })

    describe('when several errors occur', function(){
      it('should invoke the callback with the first error', function(done){
        batch.push(function(fn){
          fn(new Error('fail one'));
        })

        batch.push(function(fn){
          fn(new Error('fail two'));
        })

        batch.end(function(err){
          err.message.should.equal('fail one');
          done();
        });
      })
    })

    describe('when .throws(false) is in effect', function(){
      it('errors should pile up', function(done){
        batch.push(function(fn){
          fn(null, 'foo');
        });

        batch.push(function(fn){
          fn(new Error('fail one'));
        });

        batch.push(function(fn){
          fn(null, 'bar');
        });

        batch.push(function(fn){
          fn(new Error('fail two'));
        });

        batch.push(function(fn){
          fn(null, 'baz');
        });

        batch.throws(false);

        batch.end(function(err, res){
          err.should.be.an.instanceOf(Array);
          assert(null == err[0]);
          assert('fail one' == err[1].message);
          assert(null == err[2]);
          assert('fail two' == err[3].message);
          res.should.eql(['foo', undefined, 'bar', undefined, 'baz']);
          done();
        });
      })
    })
  })
})
