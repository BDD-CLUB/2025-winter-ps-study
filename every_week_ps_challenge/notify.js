const moment = require("moment");
require("moment-timezone");
const { getDiscussions, getNotifyDiscussions, createDiscussion } = require("./graphql");
const { members, activeMembers } = require("./data");

moment.tz.setDefault("Asia/Seoul");

async function repo() {
  const { repository, viewer } = await getDiscussions();
  const now = moment();
  const last_week = now.clone().subtract(7, "d");

  const resultTitle = await makeTitle(last_week, now);

  const filteredDiscussions = filterThisWeekDiscussion(repository, last_week);
  const thisWeekDiscussionCount = filteredDiscussions.length;

  const result = makeResult(filteredDiscussions);
  const sortedResult = Object.entries(result).sort((a, b) => b[1] - a[1]);

  const resultContent = makeContent(thisWeekDiscussionCount, sortedResult, now);
  await createDiscussion(resultTitle, resultContent)
    .then(() => {
      console.log("통계가 성공적으로 업로드되었습니다.");
    })
    .catch((e) => {
      console.log("문제가 발생했습니다.");
    });
  return { repository, viewer };
}

function filterThisWeekDiscussion(repository, last_week) {
  return repository.discussions.edges.filter((edge) => {
    return moment(edge.node.createdAt) > last_week && edge.node.category.name !== "report" && edge.node.category.name !== "announcements";
  });
}

async function makeTitle(last_week, now) {
  const { repository } = await getNotifyDiscussions();
  const notificationCount = repository.discussions.totalCount;
  const yesterday = now.clone().subtract(1, "d");

  return ` $겨울 알고리즘 챌린지{notificationCount + 1}회차 통계(${last_week.format("MM월 DD일")} ~ ${yesterday.format("MM월 DD일")})`;
}

function makeResult(filteredDiscussions) {
  let result = {};
  Object.keys(members)
    .filter((member) => activeMembers.find((activeMember) => activeMember === member))
    .map((member) => {
      result[members[member]] = 0;
    });
  filteredDiscussions.map((edge) => {
    result[members[edge.node.author.login]]++;
  });
  return result;
}

function makeContent(thisWeekDiscussionCount, sortedResult, now) {
  let resultText = "";
  sortedResult.map(([name, count]) => {
    resultText += `| ${name} | ${count} | \n  `;
  });
  const topMembers = sortedResult.filter(([_, count]) => count === sortedResult[0][1]).map(([name]) => name);
  const bottomMembers = sortedResult.filter(([_, count]) => count === sortedResult[sortedResult.length - 1][1]).map(([name]) => name);

  return `
  ## 🥳 지난 주 챌린지 수행 결과: 총 ${thisWeekDiscussionCount}개 글 작성
  
  ### ✍️ 멤버별 작성한 글 수:
  
  | 닉네임 | 게시물 수 |
  | -------- | ---------- |
  ${resultText}
  
  ### 🏆 이번 주 알고리즘 최강자: ${topMembers.join(", ")} 👑
  
  ### 🥺 이번 주 꼴찌: ${bottomMembers.join(", ")} 🔫
  
  다음 주엔 다들 더 화이팅이에요! 🌟
  `;
}

repo();
