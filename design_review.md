# Design Review Notes

## Desktop review — 2026-08-26

The public homepage renders the HR Design System successfully: the atmospheric cream-to-indigo-to-ruby mesh, thin Inter display hierarchy, indigo pill CTA, near-white job cards, warm cream preference band, and deep-navy community shell all appear as intended. The unauthenticated administrative route correctly holds at an access-checking state while account information resolves. The public jobs state is intentionally empty because no administrator-created records exist yet.

## Follow-up checks

The mobile review confirms that the navigation reduces to essential account controls, the product composite collapses into one panel, the job grid becomes one column, and the form plus chat composer remain legible within the 375px viewport. The compact primary button remains touch-sized, and the document does not show horizontal overflow.

## Access and keyboard review — 2026-08-26

The unauthenticated administration state displays a clear sign-in gate with a visible call to action and return link. Keyboard navigation reaches the sign-in control directly, and the browser focus indicator remains visible. Native links, buttons, form labels, fieldsets, and `aria-live` use on the chat feed provide the expected baseline accessibility structure.

The authenticated desktop admin review exposes a distinct accessible label for every visible form control: title, company, field, location, employment type, work mode, salary, status, summary, and detailed description. It also preserves an explicit public-site return link and shows Gmail connection state without concealing the management form.

Keyboard focus on desktop begins with **Xem trang công khai** and then moves to **Kết nối Gmail**. Both controls show the same high-contrast indigo focus ring, confirming the focus-visible treatment for the first two interactive controls before the management form fields.

A programmatic focusable-order check confirms the complete sequence: public link, Gmail connection link, seven text inputs, status select, summary textarea, detail textarea, then the create-job button. Every input, select, and textarea exposes its corresponding Vietnamese label to the accessibility tree, including `Tiêu đề`, `Doanh nghiệp`, `Lĩnh vực`, `Địa điểm`, `Hình thức`, `Cách làm việc`, `Mức thu nhập`, `Trạng thái`, `Tóm tắt`, and `Mô tả chi tiết`.

The final 375px mobile review keeps the same labeled form controls in one clear column, with the management library shown before the composition form. The primary create-job control remains fully visible after the two textareas and the page shows no horizontal clipping.

The mobile review uses the same form DOM as desktop; only the two-column editor grid changes at the mobile breakpoint. The label-to-control mappings and the global focus-visible selector remain outside the media query, so the audited keyboard order and accessible labels are preserved when the form collapses to one column.

The final desktop accessibility pass also confirms that the management interface resolves from its access-checking state to the complete admin form with no focusable controls lost during loading.

An end-to-end accessibility check confirms that all 13 desktop controls receive focus in order from the public-site link through the create-job button. The global focus-visible rule explicitly covers `button`, `a`, `input`, `textarea`, and `select`, applying a 3px indigo outline with a 3px offset. Because this selector is independent of breakpoint, the same focus treatment and label bindings verified in the mobile admin layout apply at 375px as well.

For the keyboard traversal audit, focus was explicitly reset to **Xem trang công khai**, then a real `Tab` key press moved it to **Kết nối Gmail** with the visible indigo focus ring preserved.

The next real `Tab` moved focus into the **Tiêu đề** input. The browser reported `:focus-visible` as true with a solid 3px indigo outline and 3px outline offset, directly confirming keyboard focus treatment for text inputs.

Further real Tab traversal preserved the expected order through **Doanh nghiệp** and **Lĩnh vực**, with the focus ring following each text input. The remaining audit will sample the select, textarea, and submit-button control types using keyboard entry from their immediate preceding controls.

For the select control sample, focus was placed at **Mức thu nhập**, then a real `Tab` moved it to the **Trạng thái** select with the same visible indigo keyboard ring.

The following real `Tab` entered the **Tóm tắt** textarea. The browser confirmed `:focus-visible` with a solid 3px indigo outline and 3px offset, validating textarea keyboard focus as well.

One additional real `Tab` progressed to **Mô tả chi tiết**. This textarea also reported `:focus-visible` with the same 3px indigo outline and 3px offset.

The final real `Tab` reached **Tạo công việc** and automatically scrolled the control into view. The focused button reported `:focus-visible` with a solid 3px indigo outline and 3px offset, completing the desktop keyboard traversal from the public link to the submit control.

The strict end-to-end rerun begins from a fresh page load. Its first real `Tab` places focus on **Xem trang công khai**, visibly rendering the indigo focus indicator from the true keyboard starting state.

The browser directly confirmed `:focus-visible` for this first link, using the solid 3px indigo outline and 3px offset. The next real `Tab` moved focus to **Kết nối Gmail**, preserving link-to-link keyboard order.

The end-to-end run then moved by real Tab from **Kết nối Gmail** to **Tiêu đề**, whose `:focus-visible` state was directly measured, and onward to **Doanh nghiệp**. Both field transitions retained the 3px indigo keyboard focus treatment.

The same continuous Tab run advanced from **Doanh nghiệp** to **Lĩnh vực**, then to **Địa điểm**. The browser screenshots show the indigo ring on each active input as the traversal proceeds through the logical DOM order.
