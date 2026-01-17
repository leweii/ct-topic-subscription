import { Resend } from 'resend';
import { marked } from 'marked';
import type { ArtifactContent, Language } from './types';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const EMAIL_SUBJECTS: Record<Language, string> = {
  en: 'Your Research Report is Ready',
  zh: '您的研究报告已生成',
};

const EMAIL_LABELS: Record<Language, {
  viewOnline: string;
  generatedAt: string;
  topic: string;
  coreInsight: string;
  needsAttention: string;
  poweredBy: string;
}> = {
  en: {
    viewOnline: 'View full report online',
    generatedAt: 'Generated at',
    topic: 'Topic',
    coreInsight: 'Core Insight',
    needsAttention: 'Needs Attention',
    poweredBy: 'Powered by 畅谈报告',
  },
  zh: {
    viewOnline: '在线查看完整报告',
    generatedAt: '生成时间',
    topic: '研究主题',
    coreInsight: '核心判断',
    needsAttention: '需要关注',
    poweredBy: '由畅谈报告提供支持',
  },
};

function generateReportEmailHtml(
  artifact: ArtifactContent,
  reportUrl: string,
  language: Language = 'en'
): string {
  const labels = EMAIL_LABELS[language];
  const bodyHtml = marked(artifact.output.body);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${artifact.output.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 680px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #eee;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 16px 0;
    }
    .view-online {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .view-online:hover {
      background-color: #1d4ed8;
    }
    .meta {
      font-size: 14px;
      color: #666;
    }
    .content {
      margin: 24px 0;
    }
    .content h1, .content h2, .content h3 {
      color: #1a1a1a;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .content h2 {
      font-size: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    .content h3 {
      font-size: 16px;
    }
    .content p {
      margin: 12px 0;
    }
    .content ul, .content ol {
      padding-left: 24px;
    }
    .content li {
      margin: 8px 0;
    }
    .insight-box {
      background-color: #f0f9ff;
      border-left: 4px solid #2563eb;
      padding: 16px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    .insight-box h4 {
      margin: 0 0 8px 0;
      color: #1e40af;
      font-size: 14px;
      text-transform: uppercase;
    }
    .insight-box p {
      margin: 0;
      color: #1e3a5f;
    }
    .attention-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 0 8px 8px 0;
    }
    .attention-box h4 {
      margin: 0 0 8px 0;
      color: #92400e;
      font-size: 14px;
      text-transform: uppercase;
    }
    .attention-box ul {
      margin: 0;
      padding-left: 20px;
      color: #78350f;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">${artifact.output.title}</h1>
      <a href="${reportUrl}" class="view-online">${labels.viewOnline}</a>
      <div class="meta">
        <div>${labels.topic}: ${artifact.meta.topicIntent}</div>
        <div>${labels.generatedAt}: ${new Date(artifact.meta.generatedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</div>
      </div>
    </div>

    <div class="content">
      ${bodyHtml}
    </div>

    <div class="insight-box">
      <h4>${labels.coreInsight}</h4>
      <p>${artifact.output.agentStatement}</p>
    </div>

    ${artifact.output.uncertainties.length > 0 ? `
    <div class="attention-box">
      <h4>${labels.needsAttention}</h4>
      <ul>
        ${artifact.output.uncertainties.map(u => `<li>${u}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div class="footer">
      <p>${labels.poweredBy}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface SendReportEmailParams {
  to: string;
  artifact: ArtifactContent;
  reportUrl: string;
  language?: Language;
}

export async function sendReportEmail({
  to,
  artifact,
  reportUrl,
  language = 'en',
}: SendReportEmailParams): Promise<{ success: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || '畅谈报告 <reports@resend.dev>',
      to,
      subject: `${artifact.output.title} - ${EMAIL_SUBJECTS[language]}`,
      html: generateReportEmailHtml(artifact, reportUrl, language),
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: (err as Error).message };
  }
}
