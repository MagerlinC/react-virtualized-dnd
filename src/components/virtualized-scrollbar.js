import React, {Component} from 'react';
import {Scrollbars} from 'react-custom-scrollbars';

class VirtualizedScrollBar extends Component {
	constructor(props) {
		super(props);
		this.state = {
			// Update this when dynamic row height becomes a thing
			rowHeight: this.props.staticRowHeight ? this.props.staticRowHeight : 50,
			scrollOffset: 0,
			elemOverScan: this.props.overScan ? this.props.overScan : 3,
			topSpacerHeight: 0,
			unrenderedBelow: 0,
			unrenderedAbove: 0
		};
		this.stickyElems = null;
	}

	// If we use static row height, we can optimizie by finding the first element to render, and rendering (containersize + overScan / index * height) elems after the first.
	getListToRenderStaticOptimization(list) {
		let listToRender = [];
		this.stickyElems = [];
		const rowHeight = this.state.rowHeight;
		const containerHeight = this.props.containerHeight;
		const maxVisibleElems = Math.floor(containerHeight / rowHeight);
		if (!containerHeight || this.state.scrollOffset == null) {
			return list;
		}

		let smallestIndexVisible = null;
		if (this.state.scrollOffset === 0 && this.props.stickyElems.length === 0) {
			smallestIndexVisible = 0;
		} else {
			for (let index = 0; index < list.length; index++) {
				const child = list[index];
				// Maintain elements that have the alwaysRender flag set. This is used to keep a dragged element rendered, even if its scroll parent would normally unmount it.
				if (this.props.stickyElems.find(id => id === child.props.draggableId)) {
					this.stickyElems.push(child);
				} else {
					const ySmallerThanList = (index + 1) * rowHeight < this.state.scrollOffset;

					if (ySmallerThanList) {
						// Keep overwriting to obtain the last element that is not smaller
						smallestIndexVisible = index;
					}
				}
			}
		}

		const start = Math.max(0, (smallestIndexVisible != null ? smallestIndexVisible : 0) - this.state.elemOverScan);
		// start plus number of visible elements plus overscan
		const end = smallestIndexVisible + maxVisibleElems + this.state.elemOverScan;
		// +1 because Array.slice isn't inclusive
		listToRender = list.slice(start, end + 1);
		// Remove any element from the list, if it was included in the stickied list
		if (this.stickyElems && this.stickyElems.length > 0) {
			listToRender = listToRender.filter(elem => !this.stickyElems.find(e => e.props.draggableId === elem.props.draggableId));
		}
		return listToRender;
	}

	getListToRender(list) {
		let listToRender = [];
		this.stickyElems = [];
		const rowHeight = this.state.rowHeight;
		const containerHeight = this.props.containerHeight;
		const overScan = 0; //this.state.elemOverScan * this.state.rowHeight;
		if (!containerHeight || this.state.scrollOffset == null) {
			return list;
		}

		if (this.props.staticRowHeight) {
			return this.getListToRenderStaticOptimization(list);
		}
		list.forEach((child, index) => {
			// Maintain elements that have the alwaysRender flag set. This is used to keep a dragged element rendered, even if its scroll parent would normally unmount it.
			if (this.props.stickyElems.find(id => id === child.props.draggableId)) {
				this.stickyElems.push(child);
			} else {
				// Don't render if we're below the current scroll offset, or if we're above the containerHeight + scrollOffset
				const ySmallerThanList = (index + 1) * rowHeight + overScan < this.state.scrollOffset;
				const yLargerThanList = (index + 1) * rowHeight - overScan > this.state.scrollOffset + containerHeight;

				if (!ySmallerThanList && !yLargerThanList) {
					listToRender.push(child);
				}
			}
		});

		return listToRender;
	}

	// Save scroll position in state for virtualization
	handleScroll(e) {
		const scrollOffset = this.scrollBars ? this.scrollBars.getScrollTop() : 0;
		if (this.state.scrollOffset !== scrollOffset) {
			this.setState({scrollOffset: scrollOffset});
		}
	}

	// Get height of virtualized scroll container
	getScrollHeight() {
		return this.scrollBars.getScrollHeight();
	}
	// Set scroll offset of virtualized scroll container
	scrollTop(val) {
		this.scrollBars.scrollTop(val);
	}
	// Get scroll offset of virtualized scroll container
	getScrollTop() {
		return this.scrollBars.getScrollTop();
	}

	render() {
		const {children} = this.props;
		const rowCount = children.length;
		const height = rowCount * this.state.rowHeight;
		let childrenWithProps = React.Children.map(children, (child, index) => React.cloneElement(child, {originalindex: index}));

		const hasScrolled = this.state.scrollOffset > 0;

		const listToRender = this.getListToRender(childrenWithProps);

		const unrenderedBelow = hasScrolled ? (listToRender && listToRender.length > 0 ? listToRender[0].props.originalindex : 0) - (this.stickyElems ? this.stickyElems.length : 0) : 0;
		const unrenderedAbove = listToRender && listToRender.length > 0 ? childrenWithProps.length - (listToRender[listToRender.length - 1].props.originalindex + 1) : 0;
		const belowSpacerStyle = {width: '100%', height: unrenderedBelow ? unrenderedBelow * this.state.rowHeight : 0};
		const aboveSpacerStyle = {width: '100%', height: unrenderedAbove ? unrenderedAbove * this.state.rowHeight : 0};
		if (this.stickyElems && this.stickyElems.length > 0) {
			listToRender.push(this.stickyElems[0]);
		}
		return (
			<Scrollbars onScroll={this.handleScroll.bind(this)} ref={div => (this.scrollBars = div)} autoHeight={false} autoHeightMax={500} autoHeightMin={500}>
				<div
					className={'virtualized-scrollbar-inner'}
					style={{
						width: '100%',
						display: 'flex',
						flexDirection: 'column',
						flexGrow: '1',
						minHeight: height,
						height: height,
						maxHeight: height
					}}
					ref={div => (this._test = div)}
				>
					<div style={belowSpacerStyle} className={'below-spacer'} />
					{listToRender}
					<div style={aboveSpacerStyle} className={'above-spacer'} />
				</div>
			</Scrollbars>
		);
	}
}
VirtualizedScrollBar.propTypes = {};
export default VirtualizedScrollBar;
