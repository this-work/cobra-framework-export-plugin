import { getLocaleFromUri } from '@/plugins/vanilla/page-helper';

export default (ctx, inject) => {

    inject('export', {

        async pageData(type, slug = ctx.route.params.slug) {

            return await import('@/assets/export/data/' + getLocaleFromUri(ctx) + '/' + type + '/' + slug + '.json');

        }

    });

};
