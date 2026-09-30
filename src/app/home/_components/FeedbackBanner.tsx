import styles from "./FeedbackBanner.module.css";

export function FeedbackBanner() {
  return (
    <div aria-hidden="true" className={styles.banner}>
      <div className={styles.canvas}>
        <span className={styles.badge}>EVENT</span>
        <p className={styles.subtitle}>
          우때를 써보고 <strong>아쉬운 점</strong>이나 <strong>좋았던 점</strong>이 있었다면? 🥹
        </p>
        <p className={styles.title}>
          <span className={styles.feedback}>피드백</span> 남기고<br />
          <span className={styles.reward}>싸이버거</span> 받아 가세요!
        </p>
        <p className={styles.period}>이벤트 기간 : ~10/25일</p>
        <div className={styles.cta}>피드백 남기러가기 &gt;</div>
        <div className={styles.appPreview} />
        <div className={styles.burger} />
      </div>
    </div>
  );
}
