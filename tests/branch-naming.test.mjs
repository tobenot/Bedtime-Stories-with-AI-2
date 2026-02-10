/**
 * 分支命名逻辑测试
 * 
 * 需求说明：
 * 1. 没有"（分支X）"后缀 → 截断 + "（分支）"
 * 2. 有"（分支）"后缀（无数字） → 改成"（分支2）"
 * 3. 有"（分支X）"后缀（有数字） → 改成"（分支X+1）"
 * 
 * 注意：
 * - 标题最大长度为 MAX_TITLE_LENGTH (26字符)
 * - 如果标题过长，会先截断基础部分，再添加后缀
 */

const MAX_TITLE_LENGTH = 26;
const BRANCH_SUFFIX = '（分支）';

function truncateTitleIfNeeded(title) {
  if (!title) return title
  return title.length > MAX_TITLE_LENGTH ? (title.slice(0, MAX_TITLE_LENGTH) + '...') : title
}

function generateUniqueBranchTitle(baseTitle, forceBranch = false) {
  const title = (baseTitle && baseTitle.trim()) ? baseTitle.trim() : '新对话'
  
  const match = title.match(/^(.+?)（分支(\d+)?）$/)
  
  if (match) {
    const base = match[1]
    const currentIndex = match[2] ? parseInt(match[2], 10) : 1
    const nextIndex = currentIndex + 1
    const suffixWithNumber = `（分支${nextIndex}）`
    const maxSuffixLength = suffixWithNumber.length
    const maxBaseLength = Math.max(0, MAX_TITLE_LENGTH - maxSuffixLength)
    const trimmedBase = base.length > maxBaseLength ? base.slice(0, maxBaseLength) : base
    return `${trimmedBase}${suffixWithNumber}`
  }
  
  if (!forceBranch) {
    return truncateTitleIfNeeded(title)
  }
  
  const maxSuffixLength = BRANCH_SUFFIX.length
  const maxBaseLength = Math.max(0, MAX_TITLE_LENGTH - maxSuffixLength)
  const trimmedTitle = title.length > maxBaseLength ? title.slice(0, maxBaseLength) : title
  return `${trimmedTitle}${BRANCH_SUFFIX}`
}

function testBranchNaming() {
  console.log('=== 分支命名逻辑测试 ===\n');
  console.log(`MAX_TITLE_LENGTH: ${MAX_TITLE_LENGTH}`);
  console.log(`BRANCH_SUFFIX: "${BRANCH_SUFFIX}" (长度: ${BRANCH_SUFFIX.length})\n`);
  
  console.log('=== 测试1：没有"（分支X）" → 截断 + "（分支）" ===\n');
  const baseTitle = 'Deep Talk Cardss 简介优化';
  console.log(`原始标题: "${baseTitle}" (长度: ${baseTitle.length})`);
  const result1 = generateUniqueBranchTitle(baseTitle, true);
  console.log(`结果: "${result1}" (长度: ${result1.length})`);
  console.log(`预期: "Deep Talk Cardss 简介优化（分支）" (长度: 25)\n`);
  console.assert(result1 === 'Deep Talk Cardss 简介优化（分支）', '测试1失败');
  console.assert(result1.length === 25, '测试1长度检查失败');
  
  console.log('=== 测试2：有"（分支）" → 改成"（分支2）" ===\n');
  const branchTitle = 'Deep Talk Cardss 简介优化（分支）';
  console.log(`原始标题: "${branchTitle}" (长度: ${branchTitle.length})`);
  const result2 = generateUniqueBranchTitle(branchTitle, true);
  console.log(`结果: "${result2}" (长度: ${result2.length})`);
  console.log(`预期: "Deep Talk Cardss 简介优化（分支2）" (长度: 26)\n`);
  console.assert(result2 === 'Deep Talk Cardss 简介优化（分支2）', '测试2失败');
  console.assert(result2.length === 26, '测试2长度检查失败');
  
  console.log('=== 测试3：有"（分支2）" → 改成"（分支3）" ===\n');
  const branch2Title = 'Deep Talk Cardss 简介优化（分支2）';
  console.log(`原始标题: "${branch2Title}" (长度: ${branch2Title.length})`);
  const result3 = generateUniqueBranchTitle(branch2Title, true);
  console.log(`结果: "${result3}" (长度: ${result3.length})`);
  console.log(`预期: "Deep Talk Cardss 简介优化（分支3）" (长度: 26)\n`);
  console.assert(result3 === 'Deep Talk Cardss 简介优化（分支3）', '测试3失败');
  console.assert(result3.length === 26, '测试3长度检查失败');
  
  console.log('=== 测试4：有"（分支99）" → 改成"（分支100）"（会截断基础部分） ===\n');
  const branch99Title = 'Deep Talk Cardss 简介优化（分支99）';
  console.log(`原始标题: "${branch99Title}" (长度: ${branch99Title.length})`);
  const result4 = generateUniqueBranchTitle(branch99Title, true);
  console.log(`结果: "${result4}" (长度: ${result4.length})`);
  console.log(`预期: 因为"（分支100）"比"（分支99）"长1字符，会截断基础部分以保持总长度26字符\n`);
  console.assert(result4.length === 26, '测试4长度检查失败');
  console.assert(result4.endsWith('（分支100）'), '测试4后缀检查失败');
  
  console.log('=== 测试5：长标题截断 ===\n');
  const longTitle = '这是一个非常非常非常非常非常非常非常长的标题测试';
  console.log(`原始标题: "${longTitle}" (长度: ${longTitle.length})`);
  const result5 = generateUniqueBranchTitle(longTitle, true);
  console.log(`结果: "${result5}" (长度: ${result5.length})`);
  console.log(`预期: 截断到22字符 + "（分支）" = 26字符\n`);
  console.assert(result5.length === 26, '测试5长度检查失败');
  console.assert(result5.endsWith('（分支）'), '测试5后缀检查失败');
  
  console.log('=== 测试6：连续从原始标题分叉（应该每次都生成"（分支）"） ===\n');
  const originalTitle = 'Deep Talk Cardss 简介优化';
  console.log(`原始标题: "${originalTitle}"`);
  for (let i = 0; i < 3; i++) {
    const result = generateUniqueBranchTitle(originalTitle, true);
    console.log(`分叉 ${i + 1}: "${result}"`);
    console.assert(result === 'Deep Talk Cardss 简介优化（分支）', `测试6-${i + 1}失败`);
  }
  console.log('\n说明：每次从原始标题分叉，都会生成相同的"（分支）"标题，这是正常的。\n');
  
  console.log('=== 测试7：从分支标题继续分叉 ===\n');
  let currentTitle = 'Deep Talk Cardss 简介优化';
  const expectedSequence = [
    'Deep Talk Cardss 简介优化（分支）',
    'Deep Talk Cardss 简介优化（分支2）',
    'Deep Talk Cardss 简介优化（分支3）',
    'Deep Talk Cardss 简介优化（分支4）',
    'Deep Talk Cardss 简介优化（分支5）'
  ];
  for (let i = 0; i < 5; i++) {
    const result = generateUniqueBranchTitle(currentTitle, true);
    console.log(`第 ${i + 1} 次: "${currentTitle}" → "${result}"`);
    console.assert(result === expectedSequence[i], `测试7-${i + 1}失败，期望: ${expectedSequence[i]}, 实际: ${result}`);
    currentTitle = result;
  }
  
  console.log('\n=== 测试8：边界情况 - 刚好22字符的标题 ===\n');
  const exact22Title = 'A'.repeat(22);
  console.log(`原始标题: "${exact22Title}" (长度: ${exact22Title.length})`);
  const result8 = generateUniqueBranchTitle(exact22Title, true);
  console.log(`结果: "${result8}" (长度: ${result8.length})`);
  console.assert(result8.length === 26, '测试8长度检查失败');
  console.assert(result8.endsWith('（分支）'), '测试8后缀检查失败');
  
  console.log('\n=== 测试9：边界情况 - 刚好26字符的标题 ===\n');
  const exact26Title = 'A'.repeat(26);
  console.log(`原始标题: "${exact26Title}" (长度: ${exact26Title.length})`);
  const result9 = generateUniqueBranchTitle(exact26Title, true);
  console.log(`结果: "${result9}" (长度: ${result9.length})`);
  console.assert(result9.length === 26, '测试9长度检查失败');
  console.assert(result9.endsWith('（分支）'), '测试9后缀检查失败');
  
  console.log('\n=== 所有测试通过 ===\n');
}

testBranchNaming();
