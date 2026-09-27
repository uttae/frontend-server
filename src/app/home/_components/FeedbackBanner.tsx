import Image from "next/image";

import styles from "./FeedbackBanner.module.css";

const appPreview = "/rooms/banners/feedback/app-preview.png";
const burger = "/rooms/banners/feedback/burger.png";

export function FeedbackBanner() {
  return (
    <div className="relative aspect-[1136/237] w-full overflow-hidden rounded-[8px] bg-[#d6f2ff] [container-type:inline-size] mobile:aspect-[353/113]">
      <div className={styles.callToAction}>
        <span>피드백 남기러가기 &gt;</span>
      </div>
      <div className={styles.appPreview}>
        <Image src={appPreview} alt="" fill sizes="(max-width: 639px) 103px, 260px" loading="eager" className={styles.appPreviewImage} />
      </div>
      <div className={styles.burger}>
        <Image src={burger} alt="" fill sizes="(max-width: 639px) 89px, 224px" loading="eager" className={styles.burgerImage} />
      </div>
      <p className={styles.question}>
        우때를 써보고 <strong>아쉬운 점</strong>이나 <strong>좋았던 점</strong>이 있었다면? 🥹
      </p>
      <p className={styles.title}>
        <span className={styles.blue}>피드백</span> 남기고<br />
        <span className={styles.orange}>싸이버거</span> 받아 가세요!
      </p>
      <p className={styles.date}>이벤트 기간 : ~10/25일</p>
    </div>
  );
}
