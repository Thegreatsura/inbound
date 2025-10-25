import { NextResponse } from 'next/server'
import { basehub } from 'basehub'

/**
 * Returns upgrade banner content from Basehub with sensible defaults.
 * Matches the style of homepage/blog fetching patterns.
 */
export async function GET() {
  try {
    const selection = {
      settings: {
        upgradeBannerShown: true,
        upgradeBannerTitle: true,
        upgradeBannerBody: true,
        upgradeBannerLinkText: true,
        upgradeBannerLink: true,
        shownToPlans: true,
      },
    } as any

    let data: any = null
    try {
      data = await basehub().query(selection)
    } catch (err) {
      // swallow basehub errors and use defaults below
    }

    const settings = data?.settings || {}

    const payload = {
      shown: Boolean(settings.upgradeBannerShown ?? false),
      title: settings.upgradeBannerTitle || 'Upgrade to Pro',
      body:
        settings.upgradeBannerBody ||
        'Unlock higher limits, advanced routing, and priority support.',
      linkText: settings.upgradeBannerLinkText || 'View pricing',
      link: settings.upgradeBannerLink || '/pricing',
      shownToPlans: settings.shownToPlans || ["pro", "scale", "growth"],
    }

    return NextResponse.json({ success: true, banner: payload })
  } catch (error) {
    return NextResponse.json(
      {
        success: true,
        banner: {
          shown: false,
          shownToPlans: ["pro", "scale", "growth"],
          title: 'Upgrade to Pro',
          body: 'Unlock higher limits, advanced routing, and priority support.',
          linkText: 'View pricing',
          link: '/pricing',
        },
      },
      { status: 200 }
    )
  }
}


