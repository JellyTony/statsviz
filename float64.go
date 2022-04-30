// Adapted from https://github.com/uber-go/atomic
// Original copyright below (MIT license):
//
// Copyright (c) 2020-2021 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

package statsviz

import (
	"encoding/json"
	"math"
	"sync/atomic"
)

type nocmp [0]func()

// Float64 is an atomic type-safe wrapper for float64 values.
type atomicFloat64 struct {
	_ nocmp // disallow non-atomic comparison

	v uint64
}

var _zeroFloat64 float64

// newFloat64 creates a new Float64.
func newFloat64(val float64) *atomicFloat64 {
	x := &atomicFloat64{}
	if val != _zeroFloat64 {
		x.Store(val)
	}
	return x
}

// load atomically loads the wrapped float64.
func (x *atomicFloat64) load() float64 {
	return math.Float64frombits(atomic.LoadUint64(&x.v))
}

// Store atomically stores the passed float64.
func (x *atomicFloat64) Store(val float64) {
	atomic.StoreUint64(&x.v, math.Float64bits(val))
}

// MarshalJSON encodes the wrapped float64 into JSON.
func (x *atomicFloat64) MarshalJSON() ([]byte, error) {
	return json.Marshal(x.load())
}

// UnmarshalJSON decodes a float64 from JSON.
func (x *atomicFloat64) UnmarshalJSON(b []byte) error {
	var v float64
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	x.Store(v)
	return nil
}
