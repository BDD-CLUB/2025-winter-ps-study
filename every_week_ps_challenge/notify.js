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

  const filteredDiscussions = filterThisWeekDiscussion(repository, last_week, now);
  const thisWeekDiscussionCount = filteredDiscussions.length;

  const result = makeResult(filteredDiscussions);
  const sortedResult = Object.entries(result).sort((a, b) => b[1] - a[1]);

  const resultContent = makeContent(thisWeekDiscussionCount, sortedResult, now);
  await createDiscussion(resultTitle, resultContent)
    .then(() => {
      console.log("통계가 성공적으로 업로드되었습니다.");
    })
    .catch((e) => {
      console.error("문제가 발생했습니다:", e.message);
    });
}

function filterThisWeekDiscussion(repository, last_week, now) {
  return repository.discussions.edges.filter((edge) => {
    const createdAt = moment(edge.node.createdAt);
    return createdAt.isBetween(last_week, now, null, "[)") && edge.node.category.name !== "Report" && edge.node.category.name !== "Announcements";
  });
}

async function makeTitle(last_week, now) {
  const { repository } = await getNotifyDiscussions();
  const notificationCount = repository.discussions.totalCount;
  const yesterday = now.clone().subtract(1, "d");

  return `겨울 알고리즘 챌린지 ${notificationCount + 1}회차 통계(${last_week.format("MM월 DD일")} ~ ${yesterday.format("MM월 DD일")})`;
}

function makeResult(filteredDiscussions) {
  let result = {};
  Object.keys(members)
    .filter((member) => activeMembers.includes(member))
    .forEach((member) => {
      result[members[member]] = 0;
    });

  filteredDiscussions.forEach((edge) => {
    const author = members[edge.node.author.login];
    if (author) {
      result[author]++;
    }
  });

  return result;
}

function makeContent(thisWeekDiscussionCount, sortedResult, now) {
  let resultText = "";
  sortedResult.forEach(([name, count]) => {
    resultText += `| ${name} | ${count || 0} | \n  `;
  });

  const maxCount = sortedResult[0][1];
  const minCount = sortedResult[sortedResult.length - 1][1];

  const topMembers = sortedResult.filter(([_, count]) => count === maxCount && count > 0).map(([name]) => name);
  const bottomMembers = sortedResult.filter(([_, count]) => count === minCount && count >= 0).map(([name]) => name);

  const topText = topMembers.length ? `🏆 이번 주 알고리즘 최강자: ${topMembers.join(", ")} 👑` : `🥱 이번 주에는 최강자가 없네요. 다음 주를 기대해요! ✨`;

  const bottomText = bottomMembers.length ? `🥺 이번 주 꼴찌: ${bottomMembers.join(", ")} 🔫` : `🎉 이번 주에는 모두가 잘했어요! 🥳`;

  return `
  ## 🥳 지난 주 챌린지 수행 결과: 총 ${thisWeekDiscussionCount}개 글 작성
  
  ### ✍️ 멤버별 작성한 글 수:
  
  | 닉네임 | 게시물 수 |
  | -------- | ---------- |
  ${resultText}
  
  ${topText}
  
  ${bottomText}
  
  다음 주엔 다들 더 화이팅이에요! 🌟
  `;
}

repo();
