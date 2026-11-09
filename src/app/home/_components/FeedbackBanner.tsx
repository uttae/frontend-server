import styles from "./FeedbackBanner.module.css";

export function FeedbackBanner() {
  return (
    <div aria-hidden="true" className={styles.banner}>
      <div className={styles.canvas}>
        <p className={styles.subtitle}>
          우때 써보니 어떠셨나요? <strong>짧은 한마디</strong>도 큰 힘이 돼요!
        </p>
        <p className={styles.title}>
          우때는 여러분의 <span className={styles.feedback}>피드백</span>으로<br />
          더 좋은 여행계획 도구로 발전 중!
        </p>
        <div className={styles.cta}>지금 피드백 남기기 &gt;</div>
        <div className={styles.appPreview} />
        <div className={styles.reviewIcon} />
      </div>
    </div>
  );
}
