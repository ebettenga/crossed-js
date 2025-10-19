it('fail aggregate', () => {
  throw new AggregateError([new Error('inner')], 'test aggregate');
});
