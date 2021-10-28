import { isObjectEmpty } from '../source/shared/utils';

describe('Is object empty?', ()=>{
  it('should return true', () => {
    let result = isObjectEmpty({});
    expect(result).toBe(true);
  })
});